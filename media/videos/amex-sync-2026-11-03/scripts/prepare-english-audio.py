import json, subprocess, wave
from pathlib import Path
# Pause edits lie inside measured silence; retain every speech sample at original speed.
pauses=[(4.14,.6),(8.88,.65),(15.6,.7),(20.25,1),(24.4,.7),(27.9,.65),(38.4,1),(41.7,.5)]
subprocess.run(['ffmpeg','-y','-v','error','-i','audio-source/narration-en-jessica-take-01.mp3','-ar','48000','-ac','1','qa/jessica-pcm.wav'],check=True)
with wave.open('qa/jessica-pcm.wav','rb') as r: raw=r.readframes(r.getnframes())
chunks=[];prev=0
for cut,pause in pauses:
 at=round(cut*48000)*2;chunks.extend([raw[prev:at],bytes(round(pause*48000)*2)]);prev=at
chunks.append(raw[prev:])
with wave.open('public/audio/narration-en-edited.wav','wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(48000);w.writeframes(b''.join(chunks))
def master(t):return round(t+.8+sum(n for c,n in pauses if c<t),3)
segments=json.loads(Path('qa/jessica.json').read_text(errors='replace'))['transcription']
corrections={'Your cards come with perks, keeping tracks shouldn\'t be another':"Your cards come with perks. Keeping track shouldn't be another",'Meet perks reminder, add your cards and bring your benefits into':'Meet Perks Reminder. Add your cards and bring your benefits into','Finished it? Market claimed.':'Finished it? Mark it claimed.','The new AMX extension reads benefit progress from your signed-in':'The new Amex extension reads benefit progress from your signed-in','Review the amounts and cycles, then preview your sync in perks':'Review the amounts and cycles, then preview your sync in Perks','reminder.':'Reminder.','Less tracking? More enjoying your perks.':'Less tracking. More enjoying your perks.'}
cap=[]
for x in segments:
 text=x['text'].strip();cap.append({'start':master(x['offsets']['from']/1000),'end':master(x['offsets']['to']/1000),'text':corrections.get(text,text)})
# Join short continuation fragments for readable subtitle cues.
merged=[]
for c in cap:
 if c['text'] in ['job.','one place.','view.','account.','Reminder.']:
  merged[-1]['text']+=' '+c['text'];merged[-1]['end']=c['end']
 else:merged.append(c)
timing={'fps':30,'frames':1800,'voiceOffset':.8,'pauseEdits':pauses,'captions':merged,'scenes':[{'id':'opening','start':0,'end':5.5},{'id':'cards','start':5.5,'end':11},{'id':'benefits','start':11,'end':18.4},{'id':'track','start':18.4,'end':24.1},{'id':'calendar','start':24.1,'end':28.9},{'id':'guides','start':28.9,'end':33.1},{'id':'amex','start':33.1,'end':44.5},{'id':'roi','start':44.5,'end':49},{'id':'close','start':49,'end':60}]}
Path('src/walkthrough-en.json').write_text(json.dumps(timing,indent=2))
def ts(t,sep=','):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{sep}{ms%1000:03}'
Path('output/captions-en.srt').write_text('\n\n'.join(f'{i+1}\n{ts(c["start"])} --> {ts(c["end"])}\n{c["text"]}' for i,c in enumerate(merged)))
Path('output/captions-en.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{ts(c["start"],".")} --> {ts(c["end"],".")}\n{c["text"]}' for c in merged))
