// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import {bundle} from '@remotion/bundler';
import {openBrowser,getCompositions,renderStill,renderMedia} from '@remotion/renderer';
import fs from 'node:fs/promises';
const timing=JSON.parse(await fs.readFile('src/walkthrough-en.json','utf8'));
const mode=process.argv[2]||'video';
const serveUrl=await bundle({entryPoint:'src/english-index.ts'});
const browser=await openBrowser('chrome');
try {
 const [composition]=await getCompositions(serveUrl,{puppeteerInstance:browser});
 if(mode==='stills'||mode==='checks'){
  const frames=mode==='checks'?[315,510,577,640,674,1285,1330,1465,1799]:timing.scenes.flatMap(s=>[Math.round((s.start+Math.min(2,(s.end-s.start)/2))*30)]);
  for(const frame of frames)await renderStill({composition,serveUrl,puppeteerInstance:browser,frame,output:`qa/en-frame-${frame}.png`,imageFormat:'png'});
  console.log('Stills saved',frames);
 }else{
  let last=-1;
  await renderMedia({composition,serveUrl,puppeteerInstance:browser,outputLocation:mode==='prototype'?'output/prototype-en.mp4':'output/perks-reminder-walkthrough-en-v3.mp4',codec:'h264',audioCodec:'aac',pixelFormat:'yuv420p',imageFormat:'jpeg',crf:18,concurrency:2,...(mode==='prototype'?{frameRange:[330,719]}:{}),onProgress:p=>{let pct=Math.floor(p.progress*10)*10;if(pct!==last){last=pct;console.log(`${pct}%`);}}});
 }
}finally{await browser.close({silent:true});}
