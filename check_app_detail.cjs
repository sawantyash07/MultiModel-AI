const token = process.env.HF_TOKEN || '';

async function checkAppPy() {
  const res = await fetch('https://huggingface.co/spaces/ai4bharat/indic-parler-tts/raw/main/app.py', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const t = await res.text();
  const lines = t.split('\n');
  console.log('Lines 170 to 320:');
  for (let i = 170; i < Math.min(320, lines.length); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
checkAppPy();
