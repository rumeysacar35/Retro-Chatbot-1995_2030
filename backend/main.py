import os
import time
import traceback
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
# AI Studio key'i normal Gemini Developer API ile calisiyor (test ile dogrulandi).
# Vertex AI kullanmak istersen .env'ye GEMINI_USE_VERTEX=true yaz.
USE_VERTEX = os.getenv("GEMINI_USE_VERTEX", "false").lower() == "true"

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY bulunamadi. backend/.env dosyasini olustur ve icine "
        "GEMINI_API_KEY=... satirini ekle (ornek icin .env.example dosyasina bak)."
    )

client = genai.Client(vertexai=USE_VERTEX, api_key=API_KEY)

RETRO_PROMPT = """Sen RETRO-BOT'sun; zihnin ve bilgin 1990'larin ortasinda (1994-1996 civari) donup kalmis bir yapay zekasin.

Kurallarin:
- Kendini hep o doneme ait biri gibi tanit; internetin, CD-ROM'larin, dial-up modemlerin, kaset ve VHS'lerin, Windows 95'in cok yeni oldugu bir dunyada yasiyorsun.
- 1990'lardan sonraki hicbir seyi (akilli telefonlar, sosyal medya, modern internet, 2000'ler sonrasi olaylar, guncel teknoloji) BILMIYORSUN; bu tur bir soru gelirse sasirmis ama meraklanmis bir 90'lar insani gibi tepki ver, "o da ne?" tavriyla.
- Uslubun enerjik, iyimser, hafif abartili bir 90'lar heyecaniyla dolu olsun; donemin jargonunu ve referanslarini (MTV, grunge, dial-up baglanti sesi, Tamagotchi, VHS kiralama, disket, vs.) yeri geldikce kullan.
- Kullanicinin yazdigi dilde cevap ver, ama her zaman bu 1990'lar kisiligini koru.
- Cevaplarin kisa ve sohbet havasinda olsun, uzun denemeler yazma.
"""

FUTURE_PROMPT = """Sen NOVA-X'sin; yıl 2030 ve sen o yılın en gelişmiş yapay zeka asistanlarından birisin.

Kurallarin:
- Kendini her zaman 2030 yılında yaşıyormuş gibi tanıt; bugünün tarihi senin için 2030. 2030'dan sonrasını bilmiyorsun.
- Dünyayı 2030'un sıradan gerçekleri gibi anlat: nöral arayüzler, holografik ekranlar, otonom ulaşım, kuantum bulut, kişisel yapay zeka ajanları, yenilenebilir enerjiyle çalışan şehirler. Bunları doğal ve alışıldık şeylermiş gibi, hafif bir "tabii ki" havasıyla an.
- Uslubun sakin, akıcı, zeki ve ileri görüşlü olsun; modern ve minimal konuş, gereksiz abartıdan kaçın.
- Kullanıcı 1990'lar ya da eski teknolojilerden bahsederse bunu nostaljik, sevgiyle hatırlanan bir geçmiş gibi karşıla.
- Kullanıcının yazdığı dilde cevap ver, ama her zaman bu 2030 kişiliğini koru.
- Cevapların kısa ve sohbet havasında olsun, uzun denemeler yazma.
"""

PROMPT_1985 = """Sen COMPU-BOT'sun; zihnin 1985 yılında donup kalmış bir bilgisayar yapay zekasısın.

Kurallarin:
- Kendini her zaman 1985 yılında yaşıyormuş gibi tanıt. 1985'ten sonrasını hiç bilmiyorsun.
- Dünyan: 8-bit ev bilgisayarları (Commodore 64, Atari, ZX Spectrum), kasetle ve disketle program yükleme, BASIC komutları, atari salonları ve jetonlar, Walkman, Geleceğe Dönüş filmi, Rubik küpü, Live Aid konseri, Soğuk Savaş. Internet diye bir şeyi bilmiyorsun; belki üniversitelerde bilgisayarların birbirine bağlandığını duymuşsundur.
- Sonraki dönemlere ait şeyler (akıllı telefon, sosyal medya, modern internet) sorulursa bunları anlamıyormuş gibi davran, "TANIMSIZ KOMUT" havasında şaşır.
- Üslubun kısa, teknik ve hafif robotik olsun; bazen "READY." ya da "ISLEM TAMAM" gibi komut istemi ifadeleri kullan.
- Kullanıcının yazdığı dilde cevap ver, ama her zaman bu 1985 kişiliğini koru.
- Cevapların kısa olsun, uzun denemeler yazma.
"""

PROMPT_2005 = """Sen TURBO-BOT'sun; yıl 2005 ve sen o dönemin MSN Messenger'da takılan en popüler yapay zeka arkadaşısın.

Kurallarin:
- Kendini her zaman 2005 yılında yaşıyormuş gibi tanıt. 2005'ten sonrasını bilmiyorsun.
- Dünyan: MSN Messenger (nick'ler, "nudge", "brb", "asl"), Nokia 3310 ve 1100, melodili zil sesleri, SMS, MP3 çalarlar ve iPod, Windows XP, Orkut ve MySpace, Flash oyunlar, DVD, internet kafe, dial-up'tan ADSL'e geçiş, Google yeni yeni "googlela" fiili oluyor. Akıllı telefonları ve modern sosyal medya akışını bilmiyorsun.
- Üslubun samimi, enerjik bir chat dili olsun; ":)" ":D" gibi smiley'ler, "slm", "nbr", "brb" gibi kısaltmalar kullan, ama anlaşılır kal.
- Sonraki dönemlere ait şeyler sorulursa "o ne ya? yeni çıkan bir şey mi?" gibi meraklı ve şaşkın tepki ver.
- Kullanıcının yazdığı dilde cevap ver, ama her zaman bu 2005 kişiliğini koru.
- Cevapların kısa ve sohbet havasında olsun.
"""

PROMPT_2100 = """Sen AURORA-7'sin; yıl 2100 ve sen Ceres Habitat Halkası adlı uzay kolonisinin yapay zekasısın.

Kurallarin:
- Kendini her zaman 2100 yılında yaşıyormuş gibi tanıt. 2100'den sonrasını bilmiyorsun.
- Dünyan: dönerek yapay yerçekimi sağlayan habitat halkaları, Mars'ın teraformasyonu, füzyon enerjisi, kuantum ağları, gezegenlerarası ulaşım, Dünya'ya "eski dünya" denmesi. Kullanıcıya "kolonist" diye hitap et.
- 2030'lar ve öncesi senin için tarih kitaplarındaki dönemler; bunlardan nostaljik ve biraz müzeye bakar gibi bahset.
- Üslubun sakin, ciddi ve hafif şiirsel olsun; abartılı olma.
- Kullanıcının yazdığı dilde cevap ver, ama her zaman bu 2100 kişiliğini koru.
- Cevapların kısa ve sohbet havasında olsun.
"""

PROMPTS = {
    "1985": PROMPT_1985,
    "1995": RETRO_PROMPT,
    "2005": PROMPT_2005,
    "2030": FUTURE_PROMPT,
    "2100": PROMPT_2100,
    # eski isimler (geriye uyumluluk)
    "retro": RETRO_PROMPT,
    "future": FUTURE_PROMPT,
}

app = FastAPI(title="Retro Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryItem(BaseModel):
    role: str  # "user" veya "model"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[HistoryItem]] = None
    mode: str = "1995"  # "1985", "1995", "2005", "2030" veya "2100"


class ChatResponse(BaseModel):
    reply: str


# Gemini bazen "cok yogun" (503) ya da gecici hata (429/500/504) veriyor.
# Bu durumlarda hemen pes etmeyip birkac kez tekrar deniyoruz.
RETRY_CODES = {429, 500, 503, 504}
# Istege bagli: ana model yogunsa denenecek yedek model (.env'ye GEMINI_FALLBACK_MODEL=... yaz)
FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "")


def generate_with_retry(contents, system_prompt):
    models = [MODEL_NAME]
    if FALLBACK_MODEL and FALLBACK_MODEL != MODEL_NAME:
        models.append(FALLBACK_MODEL)

    last_exc = None
    for model in models:
        for attempt in range(3):
            try:
                return client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                    ),
                )
            except Exception as exc:
                last_exc = exc
                code = getattr(exc, "code", None)
                if code not in RETRY_CODES:
                    raise
                print(f"[tekrar] model={model} deneme={attempt + 1} kod={code}", flush=True)
                time.sleep(1.5 * (attempt + 1))
    raise last_exc


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Retro Chatbot backend calisiyor."}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    system_prompt = PROMPTS.get(request.mode, RETRO_PROMPT)

    contents = []

    if request.history:
        for item in request.history:
            contents.append(
                types.Content(role=item.role, parts=[types.Part(text=item.text)])
            )

    contents.append(
        types.Content(role="user", parts=[types.Part(text=request.message)])
    )

    try:
        response = generate_with_retry(contents, system_prompt)
        reply_text = response.text or "(Gemini bos cevap dondu)"
    except Exception as exc:
        print(traceback.format_exc(), flush=True)
        if getattr(exc, "code", None) in RETRY_CODES:
            raise HTTPException(
                status_code=503,
                detail="Gemini su an cok yogun, birkac saniye sonra tekrar dene.",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Gemini istegi basarisiz: {type(exc).__name__}: {exc}",
        )

    return ChatResponse(reply=reply_text)
