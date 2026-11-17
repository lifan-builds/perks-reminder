import {bundle} from '@remotion/bundler';
import {openBrowser,getCompositions,renderStill,renderMedia} from '@remotion/renderer';
import fs from 'node:fs/promises';
const timing=JSON.parse(await fs.readFile('src/timing.json','utf8'));
const mode=process.argv[2]||'video';
const serveUrl=await bundle({entryPoint:'src/index.ts'});
const browser=await openBrowser('chrome');
try {
 const [composition]=await getCompositions(serveUrl,{puppeteerInstance:browser});
 if(mode==='stills'){
  const frames=timing.scenes.flatMap(s=>[Math.round((s.start+Math.min(2,(s.end-s.start)/2))*30)]);
  for(const frame of frames)await renderStill({composition,serveUrl,puppeteerInstance:browser,frame,output:`qa/frame-${frame}.png`,imageFormat:'png'});
  console.log('Stills saved',frames);
 }else{
  let last=-1;
  await renderMedia({composition,serveUrl,puppeteerInstance:browser,outputLocation:mode==='prototype'?'output/prototype.mp4':'output/perks-reminder-amex-zh-v2.mp4',codec:'h264',audioCodec:'aac',pixelFormat:'yuv420p',imageFormat:'jpeg',crf:18,concurrency:2,...(mode==='prototype'?{frameRange:[0,269]}:{}),onProgress:p=>{let pct=Math.floor(p.progress*10)*10;if(pct!==last){last=pct;console.log(`${pct}%`);}}});
 }
}finally{await browser.close({silent:true});}
