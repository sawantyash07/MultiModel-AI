const token = process.env.HF_TOKEN || '';

async function checkSpeakers() {
  const res = await fetch('https://huggingface.co/spaces/ai4bharat/indic-parler-tts/raw/main/app.py', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const t = await res.text();
  const match = t.match(/finetuned_examples\s*=\s*\[([\s\S]*?)\]\n/);
  if (match) {
    console.log('finetuned_examples:');
    console.log(match[1]);
  }
}
checkSpeakers();
