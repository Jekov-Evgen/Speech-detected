import os
import math
import tempfile
import imageio_ffmpeg
from pydub import AudioSegment
from groq import Groq

# Указываем pydub использовать ffmpeg из pip-пакета (работает на Windows/Mac/Linux)
AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()

# Прогресс транскрибации: { record_id: { "progress": 0.0-1.0, "status": "processing"|"done"|"error" } }
progress_store = {}

# Модель не нужна локально — используем Groq API
model_status = "ready"

MAX_CHUNK_MB = 24  # Лимит Groq — 25 MB, оставляем запас


def _get_client() -> Groq:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        # Пробуем прочитать из .env файла в директории данных
        data_dir = os.environ.get("SPEECHDETECT_DATA_DIR", os.path.dirname(__file__))
        env_path = os.path.join(data_dir, ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GROQ_API_KEY="):
                        api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY не задан. Создайте файл backend/.env с содержимым:\n"
            "GROQ_API_KEY=ваш_ключ\n\n"
            "Получить бесплатный ключ: https://console.groq.com/keys"
        )
    return Groq(api_key=api_key)


def _transcribe_chunk(client: Groq, filepath: str) -> str:
    """Отправить один аудиофайл в Groq Whisper API."""
    with open(filepath, "rb") as f:
        result = client.audio.transcriptions.create(
            file=(os.path.basename(filepath), f.read()),
            model="whisper-large-v3-turbo",
        )
    return result.text


def transcribe(filepath: str, record_id: int = None) -> str:
    """Распознать речь через Groq API. Большие файлы автоматически нарезаются."""
    client = _get_client()

    if record_id is not None:
        progress_store[record_id] = {"progress": 0.0, "status": "processing"}

    file_size_mb = os.path.getsize(filepath) / (1024 * 1024)

    # Маленький файл — отправляем как есть
    if file_size_mb <= MAX_CHUNK_MB:
        text = _transcribe_chunk(client, filepath)
        if record_id is not None:
            progress_store[record_id] = {"progress": 1.0, "status": "done"}
        return text

    # Большой файл — нарезаем на куски
    audio = AudioSegment.from_file(filepath)
    total_duration_ms = len(audio)

    # Рассчитываем длительность куска пропорционально лимиту размера
    chunk_duration_ms = int(total_duration_ms * (MAX_CHUNK_MB / file_size_mb))
    # Не более 10 минут на кусок
    chunk_duration_ms = min(chunk_duration_ms, 10 * 60 * 1000)
    # Не менее 30 секунд
    chunk_duration_ms = max(chunk_duration_ms, 30 * 1000)

    num_chunks = math.ceil(total_duration_ms / chunk_duration_ms)
    text_parts = []

    for i in range(num_chunks):
        start = i * chunk_duration_ms
        end = min((i + 1) * chunk_duration_ms, total_duration_ms)
        chunk = audio[start:end]

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp_path = tmp.name
            chunk.export(tmp_path, format="mp3", bitrate="128k")
            text = _transcribe_chunk(client, tmp_path)
            text_parts.append(text)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

        if record_id is not None:
            progress_store[record_id]["progress"] = min((i + 1) / num_chunks, 1.0)

    if record_id is not None:
        progress_store[record_id] = {"progress": 1.0, "status": "done"}

    return " ".join(text_parts)