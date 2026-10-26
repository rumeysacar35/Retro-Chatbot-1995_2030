# Retro Chatbot

1990'larda yasadigini sanan, tum sorulara o donemin ruhuyla cevap veren bir yapay zeka chatbot.
Backend: Python + FastAPI + Gemini API. Frontend: duz HTML/CSS/JS, 90'lar tarzi tasarim.

## Kurulum ve calistirma

1. `backend/.env.example` dosyasini `backend/.env` olarak kopyala ve icine kendi Gemini API key'ini yaz.
2. Terminalde (proje kokunde):
   ```
   cd backend
   .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
3. `frontend/index.html` dosyasini cift tiklayip tarayicida ac.
