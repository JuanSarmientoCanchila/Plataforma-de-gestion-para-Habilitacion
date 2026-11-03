# Verificador de habilitación – Resolución 3100 de 2019 (versión completa)

Herramienta web para **autoevaluar el cumplimiento de los criterios de habilitación** del Anexo Técnico de la Resolución 3100 de 2019 (numeral 11), por servicio y por estándar. Pensada para consultores y para IPS pequeñas.

> Datos de ejemplo ficticios. Herramienta de autoevaluación y asesoría: no reemplaza la verificación oficial de la Secretaría de Salud ni la declaración en el REPS.

## Qué hace

- **Alcance a la medida:** eliges qué servicios y estándares evalúas.
- **Perfil por servicio:** complejidad y modalidades (intramural, extramural, telemedicina); la herramienta oculta lo que no aplica y calcula los porcentajes solo sobre lo que sí. Un interruptor permite ver todos los criterios.
- **Servicios en proyecto:** evalúa lo que una IPS necesitaría para ampliar su oferta, sin afectar el porcentaje de lo que ya tiene habilitado.
- **Cuatro estados por criterio:** Cumple, No cumple, No aplica (con motivo obligatorio) y Sin revisar, con observación.
- **Evidencias en una carpeta del computador:** los archivos no se suben a internet; se organizan por servicio y criterio.
- **Porcentajes** por servicio, estándar y global, y **tabla de brechas** con responsable y fecha compromiso.
- **Exporta a Excel** (y lo reimporta) y genera un **informe en Word**.
- **Autoguardado** y **aplicación instalable (PWA)** que también abre sin conexión.

## Capturas

| Alcance y perfil | Verificación | Resultados |
|---|---|---|
| ![Alcance](capturas/1-alcance.png) | ![Verificación](capturas/2-verificacion.png) | ![Resultados](capturas/3-resultados.png) |

## Cómo se hizo

- HTML, CSS y JavaScript sin frameworks; File System Access API para las evidencias.
- Los 3.963 requisitos se extrajeron por OCR del PDF escaneado de la resolución, se estructuraron con un programa en Python y se validaron manualmente.
- Excel con ExcelJS y Word con docx, generados en el navegador.

## Autor y licencia

**Juan Diego Sarmiento Canchila** – Bioingeniero, Universidad de Antioquia
Contacto: juan.sarmientocanchila@gmail.com

© 2026 Todos los derechos reservados. Ver [LICENSE](LICENSE).
