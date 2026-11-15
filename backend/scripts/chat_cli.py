"""CLI interactive tester for FieldShift Agronomic Copilot."""
import sys
import requests

API_URL = "http://localhost:8000/api/v1/chat"
FIELD_ID = "plot-altiplano-01"


def main() -> None:
    print("=" * 60)
    print("🌱 FIELDSHIFT - Copiloto Agronómico (Terminal Chat Tester)")
    print(f"📡 Conectando a {API_URL}")
    print(f"📍 Parcela de prueba: {FIELD_ID}")
    print("Escribe 'salir' para terminar o 'historial' para ver los turnos.")
    print("=" * 60)

    # Health check probe
    try:
        health = requests.get("http://localhost:8000/health", timeout=3)
        if health.status_code != 200:
            print(f"⚠️ Servidor no responde adecuadamente ({health.status_code}).")
            sys.exit(1)
    except Exception as exc:
        print(f"❌ Error al conectar con el servidor: {exc}")
        print("💡 Recuerda iniciar el servidor primero con:")
        print("   source .venv/bin/activate && uvicorn src.main:app --reload")
        sys.exit(1)

    session_id = None

    while True:
        try:
            user_msg = input("\n🧑‍🌾 Tú: ").strip()
            if not user_msg:
                continue

            if user_msg.lower() in ("salir", "exit", "quit"):
                if session_id:
                    print("\nCerrando sesión en el servidor...")
                    requests.delete(f"{API_URL}/{session_id}", timeout=5)
                print("👋 ¡Hasta luego!")
                break

            if user_msg.lower() == "historial":
                if not session_id:
                    print("Aún no hay sesión activa.")
                    continue
                res = requests.get(f"{API_URL}/{session_id}/history", timeout=5)
                print("\n📜 Historial de conversación:")
                for item in res.json():
                    print(f"  [{item['role']}]: {item['text']}")
                continue

            payload = {
                "field_id": FIELD_ID,
                "message": user_msg,
                "drought_simulation": False,
            }
            if session_id:
                payload["session_id"] = session_id

            print("⏳ Pensando con Gemini 3.1 Flash Lite...")
            res = requests.post(f"{API_URL}/message", json=payload, timeout=30)

            if res.status_code != 200:
                print(f"❌ Error ({res.status_code}): {res.text}")
                continue

            data = res.json()
            session_id = data["session_id"]
            reply = data["reply"]
            history_length = data["history_length"]

            print(f"\n🤖 Copiloto Agronómico [Sesión: {session_id} | Turnos: {history_length}]:")
            print(reply)
            print(f"\n💡 {data['local_validation_reminder']}")

        except KeyboardInterrupt:
            if session_id:
                requests.delete(f"{API_URL}/{session_id}", timeout=5)
            print("\nSesión finalizada.")
            break


if __name__ == "__main__":
    main()
