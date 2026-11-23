# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
"""Original instrumental bed, generated without external samples. 96 BPM, D major."""
import math,wave,array,json
from pathlib import Path
sr=48000; duration=json.loads(Path('src/timing.json').read_text())['frames']/30
samples=array.array('f',[0.0])*int(sr*duration)
def note(start,length,midi,amp,decay=2.6):
 freq=440*2**((midi-69)/12); a=int(start*sr); count=min(int(length*sr),len(samples)-a)
 for j in range(max(0,count)):
  t=j/sr; env=min(1,t/.018)*math.exp(-t*decay)*min(1,(length-t)/.12)
  samples[a+j]+=amp*env*(math.sin(2*math.pi*freq*t)+.12*math.sin(4*math.pi*freq*t))
chords=[[50,57,61,66],[47,54,57,62],[43,50,54,59],[45,52,57,62]]
bar=2.5
for k in range(math.ceil(duration/bar)):
 chord=chords[k%4]; start=k*bar
 for n in chord:note(start,2.8,n,.027,.7)
 note(start,1.8,chord[0]-12,.055,2.2)
 for beat,n in [(0,chord[2]+12),(1.5,chord[3]+12),(3,chord[1]+12)]:note(start+beat*.625,1.2,n,.035,3.8)
 for beat in range(4):note(start+beat*.625,.13,33,.035,26)
output=array.array('h')
for i,v in enumerate(samples):
 t=i/sr;fade=min(1,t/.9,max(0,(duration-t)/2.8));output.append(int(max(-.95,min(.95,v*fade))*32767))
with wave.open('public/audio/original-bed.wav','wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(output.tobytes())
print('Original music generated:',duration,'seconds')
