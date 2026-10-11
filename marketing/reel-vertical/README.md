# Reel vertical de Vase Rest (9:16, 15 s)

Estilo **morph de UI**, basado en los prompts de @annacher y @twoclipping del catálogo awesome-opus5-5-videos: una sola
forma que nunca corta. Cada estado es la misma pieza cambiando tamaño, radio y color, y el contenido se cambia con
un blur corto. La mueven toques reales de un dedo. El lienzo es gris cálido, los componentes negros y blancos, y el
único acento es el verde de la marca. Los movimientos son resortes con apenas un rebote, a 128 BPM.

**Historia**: "Sábado, 21:40". Llegan los pedidos sueltos ("Mesa 3 pide la cuenta", "¿Queda bife?"…), "El salón
explota", y todo cae en un botón: "Respirá". De ahí la forma recorre el día: el plano en vivo con la mesa 5 demorada,
el QR (pedir, dividir y pagar), el aviso al mozo, la reserva por WhatsApp, la orden por voz con confirmación, y el
cierre "El sábado, en orden." Los datos en pantalla son de ejemplo y el video lo dice.

| Pulso (128 BPM) | Estado de la forma |
|---|---|
| 0–3.75 | pastillas del caos que se juntan en un punto |
| 3.75 | botón "Abrir Vase Rest" |
| 6 | plano de 9 mesas, la 5 late |
| 10 | la forma se mete en la mesa 5 y se abre en la carta del QR |
| 14 | dividir la cuenta, pagar, check verde |
| 17.25 | isla → aviso "Mesa 7 quiere pedir" → "Enviado a cocina" |
| 20.25 | chat de WhatsApp con el plano para elegir mesa |
| 24 | píldora de voz → antes/después → confirmar |
| 27.5 | "Vase Rest" + plataformas (cierre de 2 s) |

```bash
npm install
export CHROME_PATH=/ruta/a/chrome          # y ffmpeg en el PATH
node render.mjs --sheet=1,2.5,4,6,8,10,12,14 --cols=4 --w=300 --out=out/check/sheet.jpg
node music/score.mjs && ffmpeg -y -i music/score.wav -af "highpass=f=30,equalizer=f=250:t=q:w=1:g=-2,loudnorm=I=-14:TP=-1.2:LRA=8" -c:a aac -b:a 192k assets/score.m4a
node render.mjs --frames --workers=4
node render.mjs --encode --audio=assets/score.m4a --out=out/reel-1080x1920.mp4 --fps=30
```

Todo es canvas 2D (no hace falta GPU). Cada cuadro mezcla 3 subcuadros para el desenfoque de movimiento.
