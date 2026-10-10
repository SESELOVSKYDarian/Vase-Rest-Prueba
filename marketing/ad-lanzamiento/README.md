# Ad de lanzamiento de Vase Rest

Video de 31 s (16:9, 30 fps, 120 BPM) hecho en código con la skill `kinetic-reel`. Guion y criterios en
[STORYBOARD.md](STORYBOARD.md). Cada cuadro es una función del tiempo: `reel/cues.js` es la línea de tiempo que leen
la imagen (`reel/reel.js`) y la música (`music/score.mjs`), así cada golpe de sonido cae en su cuadro.

```bash
npm install
export CHROME_PATH=/ruta/a/chrome          # y ffmpeg en el PATH
node render.mjs --soft-gl --sheet=1,4,7,10,13,16 --cols=3 --w=640 --out=out/check/sheet.jpg   # revisar
node music/score.mjs && ffmpeg -y -i music/score.wav -af "highpass=f=30,equalizer=f=250:t=q:w=1:g=-2,loudnorm=I=-14:TP=-1.2:LRA=8" -c:a aac -b:a 192k assets/score.m4a
node render.mjs --soft-gl --frames --workers=4
node render.mjs --encode --audio=assets/score.m4a --out=out/reel.mp4 --fps=30
ffmpeg -i out/reel.mp4 -vf scale=1600:900:flags=lanczos -c:v libx264 -preset slow -crf 23 -c:a aac -b:a 128k -movflags +faststart out/vase-rest-ad.mp4
```

`--soft-gl` usa render por software (sirve en servidores sin GPU). Con GPU se puede sacar y es mucho más rápido.
Las tipografías (Anton, Archivo Black, Instrument Serif, JetBrains Mono, Inter; licencia OFL) van locales en
`reel/fonts/`. Los números, mesas, nombres y códigos en pantalla son de ejemplo y el video lo dice
(`ILUSTRATIVO · DATOS DE EJEMPLO`).
