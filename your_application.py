# Compatibilidad con placeholder por defecto de Render (gunicorn your_application.wsgi)
from server import app as wsgi
from server import app

if __name__ == "__main__":
    app.run()
