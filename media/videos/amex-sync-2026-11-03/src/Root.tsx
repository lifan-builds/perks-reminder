import React, {useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, Audio, Composition, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, delayRender, continueRender} from 'remotion';
import timing from './timing.json';
import readerPanel from './reader-panel.json';

const ink='#132930', teal='#24786c', mint='#bcf5d8', cream='#f3f2e9';
const font='"PingFang SC", "Hiragino Sans GB", "Arial", sans-serif';
const ease=(f:number,d=20)=>spring({frame:f,fps:30,config:{damping:25,stiffness:130},durationInFrames:d});
const fade=(f:number)=>interpolate(f,[0,12],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
const Kicker=({children,dark=false}:{children:React.ReactNode,dark?:boolean})=><div style={{fontSize:25,fontWeight:600,letterSpacing:5,color:dark?mint:teal,marginBottom:27}}>{children}</div>;
const Title=({children,style={}}:{children:React.ReactNode,style?:React.CSSProperties})=><div style={{fontSize:86,lineHeight:1.2,fontWeight:650,letterSpacing:-3,...style}}>{children}</div>;
const Small=({children,style={}}:{children:React.ReactNode,style?:React.CSSProperties})=><div style={{fontSize:30,lineHeight:1.6,...style}}>{children}</div>;
function Badge({children,dark=false}:{children:React.ReactNode,dark?:boolean}){return <span style={{display:'inline-flex',padding:'12px 20px',border:`1px solid ${dark?'#51756a':'#afc7be'}`,borderRadius:99,fontSize:23,color:dark?mint:teal,background:dark?'#163b3b':'#e8f2e9'}}>{children}</span>}
function Brand({light=false}:{light?:boolean}){return <div style={{display:'flex',alignItems:'center',gap:16,fontSize:27,fontWeight:650,color:light?cream:ink}}><Img src={staticFile('images/icon.png')} style={{width:46,height:46,borderRadius:12}}/>Perks Reminder</div>}
function ActualReader(){
 const ref=useRef<HTMLDivElement>(null);
 const [handle]=useState(()=>delayRender('Actual reader UI'));
 useLayoutEffect(()=>{if(ref.current){const root=ref.current.shadowRoot??ref.current.attachShadow({mode:'open'});root.innerHTML=readerPanel.html;}document.fonts.ready.then(()=>continueRender(handle));},[handle]);
 return <div ref={ref} style={{width:1280,height:800}}/>;
}
function Panel({crop='full',x=1060,y=130,scale=1.05}:{crop?:'full'|'detail'|'top',x?:number,y?:number,scale?:number}){
 const c=crop==='detail'?{x:824,y:480,w:440,h:225}:crop==='top'?{x:824,y:16,w:440,h:210}:{x:824,y:16,w:440,h:736};
 return <div style={{position:'absolute',left:x,top:y,width:c.w*scale,height:c.h*scale,overflow:'hidden',borderRadius:24,boxShadow:'0 28px 80px #001b241f',border:'1px solid #c8d5d2',background:'white'}}><div style={{position:'absolute',width:1280,height:800,left:-c.x*scale,top:-c.y*scale,transform:`scale(${scale})`,transformOrigin:'top left'}}><ActualReader/></div></div>
}
function Pain(){const f=useCurrentFrame();return <AbsoluteFill style={{background:cream,color:ink}}>
 <div style={{position:'absolute',left:110,top:200,opacity:fade(f),transform:`translateY(${(1-ease(f))*35}px)`}}><Kicker>月底，又要对一遍。</Kicker><Title>这笔 credit，<br/>到底用过没？</Title><Small style={{marginTop:42,color:'#6d7c7a'}}>逐张卡查 · 切回表格 · 手工记录</Small></div>
 <div style={{position:'absolute',left:1090,top:200,transform:`rotate(5deg) translateY(${Math.sin(f/70)*8}px)`,width:620,height:560,background:'#e5e9dd',borderRadius:26,border:'1px solid #d2d8cd'}}/>
 <div style={{position:'absolute',left:1020,top:240,width:620,height:520,background:'white',border:'1px solid #d4ddd5',borderRadius:24,padding:40,transform:`rotate(-3deg) translateY(${(1-ease(f-8))*60}px)`,opacity:fade(f-8),boxShadow:'0 40px 70px #18372b12'}}>
 <div style={{fontSize:25,color:'#61796f',marginBottom:35}}>我的福利记录</div>
 {['Gold · 餐饮','Platinum · Resy','Platinum · lululemon'].map((n,i)=><div key={n} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'27px 0',borderBottom:'1px solid #e9ede7',fontSize:27}}><span>{n}</span><span style={{color:i===1?'#bc7250':'#9ba89e',fontWeight:600}}>{f>60+i*20?'待核对':'—'}</span></div>)}
 <div style={{position:'absolute',right:-65,bottom:-48,padding:'20px 30px',fontSize:29,background:'#f9d89b',borderRadius:16,transform:'rotate(7deg)',boxShadow:'0 12px 30px #22332613'}}>还有一张忘了查？</div></div>
 </AbsoluteFill>}
function Reveal(){const f=useCurrentFrame();return <AbsoluteFill style={{background:ink,color:cream}}>
 <div style={{position:'absolute',width:970,height:970,borderRadius:'50%',border:'1px solid #42625d',left:1070,top:-100,transform:`scale(${.95+f/9000})`}}/>
 <div style={{position:'absolute',width:720,height:720,borderRadius:'50%',background:'radial-gradient(circle,#38877755,transparent 70%)',left:1100,top:90}}/>
 <div style={{position:'absolute',left:110,top:210,opacity:fade(f),transform:`translateY(${(1-ease(f))*30}px)`}}><Kicker dark>新功能 · CHROME 扩展</Kicker><Title style={{fontSize:100}}>Amex 福利，<br/><span style={{color:mint}}>自动读进来。</span></Title><Small style={{marginTop:44,color:'#b7ccc4'}}>Perks Reminder</Small></div>
 <Img src={staticFile('images/icon.png')} style={{position:'absolute',left:1270,top:300,width:300,height:300,borderRadius:75,transform:`translateY(${(1-ease(f-8))*60}px) rotate(${-8+ease(f-8)*8}deg)`,opacity:fade(f-8),boxShadow:'0 35px 90px #0004'}}/>
 <div style={{position:'absolute',left:1250,top:670}}><Badge dark>从记录工具，到自动读取</Badge></div>
 </AbsoluteFill>}
function Read(){const f=useCurrentFrame();return <AbsoluteFill style={{background:cream,color:ink}}>
 <div style={{position:'absolute',left:110,top:190,width:790,opacity:fade(f)}}><Kicker>少一步手工</Kicker><Title>登录 Amex，<br/>打开页面。</Title><Small style={{marginTop:30,color:teal,fontSize:40}}>扩展自动读取福利进度</Small>
 <div style={{display:'flex',gap:14,marginTop:55}}>{['安装扩展','登录 Amex','自动读取'].map((s,i)=><div key={s} style={{padding:'16px 24px',fontSize:25,borderRadius:14,background:i===2?teal:'#e0e6db',color:i===2?'white':ink,opacity:fade(f-i*15)}}>{s}</div>)}</div><Small style={{marginTop:32,fontSize:24,color:'#76877d'}}>在支持的 Amex 账户页面读取</Small></div>
 <div style={{opacity:fade(f-5),transform:`translateX(${(1-ease(f-5))*80}px)`}}><Panel x={1110} y={115} scale={1.08}/></div>
 <div style={{position:'absolute',right:150,top:50,fontSize:20,color:'#647a70'}}>真实扩展界面 · 示例数据</div>
 </AbsoluteFill>}
function Detail(){const f=useCurrentFrame();const detail=f>115;return <AbsoluteFill style={{background:cream,color:ink}}>
 <div style={{position:'absolute',left:110,top:160}}><Kicker>不用一张卡一张卡抄</Kicker><Title style={{fontSize:76}}>额度、已用、周期。<br/>按卡整理在一起。</Title></div>
 {!detail?<><Panel x={110} y={475} scale={1.6} crop="detail"/><div style={{position:'absolute',left:1050,top:495}}>{[['01','按卡分组'],['02','保留已用金额'],['03','显示对应周期']].map(([n,t],i)=><div key={n} style={{display:'flex',alignItems:'center',gap:25,marginBottom:35,opacity:fade(f-i*12)}}><span style={{fontSize:24,color:teal}}>{n}</span><span style={{fontSize:43}}>{t}</span></div>)}</div></>:<>
 <Panel crop="detail" x={860} y={415} scale={2.05}/>
 <div style={{position:'absolute',left:115,top:470,opacity:fade(f-115)}}><div style={{fontSize:25,color:teal,letterSpacing:3}}>PLATINUM · RESY 示例</div><div style={{display:'flex',alignItems:'baseline',gap:16,marginTop:18}}><span style={{fontSize:132,fontWeight:650,letterSpacing:-7}}>$25</span><span style={{fontSize:39,color:'#75867d'}}> / $100</span></div><div style={{fontSize:35,color:teal}}>已经用了一部分</div><div style={{width:570,height:16,borderRadius:10,background:'#d9e2d7',marginTop:30}}><div style={{width:142,height:16,borderRadius:10,background:teal}}/></div></div>
 </>}
 <div style={{position:'absolute',right:110,top:57,fontSize:20,color:'#647a70'}}>真实扩展界面 · 示例数据</div>
 </AbsoluteFill>}
function Sync(){const f=useCurrentFrame();return <AbsoluteFill style={{background:ink,color:cream}}>
 <div style={{position:'absolute',left:110,top:160,opacity:fade(f)}}><Kicker dark>更新到 PERKS REMINDER</Kicker><Title>核对一下，<br/>省掉重复录入。</Title></div>
 <Panel crop="top" x={1000} y={165} scale={1.65}/>
 <div style={{position:'absolute',left:1419,top:280,width:279,height:70,border:'3px solid #70c8a5',borderRadius:15,boxShadow:'0 0 0 6px #70c8a522',opacity:fade(f-22)}}/>
 <svg width="48" height="58" viewBox="0 0 48 58" style={{position:'absolute',left:1645,top:325,opacity:fade(f-28),transform:`translate(${(1-ease(f-28))*45}px,${(1-ease(f-28))*30}px)`}}><path d="M4 3 L7 42 L19 32 L29 53 L39 48 L29 28 L44 26 Z" fill="#f3f2e9" stroke="#132930" strokeWidth="3"/></svg>
 <div style={{position:'absolute',left:110,top:650,display:'flex',gap:36}}>{['点击同步','核对卡片与福利','确认更新'].map((s,i)=><React.Fragment key={s}><div style={{width:470,border:`1px solid ${f>i*50?'#8ac6ac':'#33504d'}`,borderRadius:22,padding:'32px 40px',background:f>i*50?'#23534c':'#183839',opacity:fade(f-i*12)}}><div style={{fontSize:23,color:mint,marginBottom:15}}>0{i+1}</div><div style={{fontSize:39}}>{s}</div></div>{i<2?<div style={{alignSelf:'center',fontSize:42,color:'#83b7a4'}}>→</div>:null}</React.Fragment>)}</div>
 <div style={{position:'absolute',right:110,top:57,fontSize:20,color:'#a8c2b7'}}>流程示意 · 示例数据</div>
 </AbsoluteFill>}
function Close(){const f=useCurrentFrame();return <AbsoluteFill style={{background:cream,color:ink}}>
 <div style={{position:'absolute',left:110,top:180,opacity:fade(f)}}><Kicker>把时间留给真正用掉福利</Kicker><Title style={{fontSize:112}}>少记一点。<br/><span style={{color:teal}}>多用一点。</span></Title><div style={{display:'flex',gap:16,marginTop:40}}>{['免费','开源','可自行部署'].map(s=><Badge key={s}>{s}</Badge>)}</div></div>
 <div style={{position:'absolute',right:180,top:260,width:470,height:340,borderRadius:36,background:ink,color:cream,padding:45,transform:`rotate(${3+Math.sin(f/80)}deg)`,boxShadow:'0 35px 70px #12382a20'}}><Img src={staticFile('images/icon.png')} style={{width:90,height:90,borderRadius:25,marginBottom:22}}/><div style={{fontSize:40,fontWeight:600}}>Perks Reminder</div><div style={{fontSize:26,color:mint,marginTop:17}}>让信用卡福利更好用</div></div>
 <div style={{position:'absolute',left:110,bottom:170,fontSize:53,fontWeight:600,letterSpacing:-1}}>perks-reminder.com <span style={{color:teal,marginLeft:25}}>↗</span></div>
 <div style={{position:'absolute',right:110,bottom:177,fontSize:22,color:'#667f74'}}>新版扩展预览 · 1.5.0 已提交商店审核</div>
 </AbsoluteFill>}
const sceneComponents={pain:Pain,reveal:Reveal,read:Read,detail:Detail,sync:Sync,close:Close};
function Film(){const f=useCurrentFrame(); const t=f/timing.fps; const cap=(timing.captions as {start:number,end:number,text:string}[]).find(c=>t>=c.start&&t<c.end); const dark=timing.scenes.some(s=>['reveal','sync'].includes(s.id)&&t>=s.start&&t<s.end);return <AbsoluteFill style={{fontFamily:font,background:cream}}>
 {timing.scenes.map(s=>{const Comp=sceneComponents[s.id as keyof typeof sceneComponents];return <Sequence key={s.id} from={Math.round(s.start*timing.fps)} durationInFrames={Math.round((s.end-s.start)*timing.fps)}><Comp/></Sequence>})}
 <div style={{position:'absolute',top:48,left:110}}><Brand light={dark}/></div>
 <div style={{position:'absolute',bottom:0,left:0,height:6,background:teal,width:`${100*f/(timing.frames-1)}%`}}/>
 {cap?<div style={{position:'absolute',left:120,right:120,bottom:38,display:'flex',justifyContent:'center'}}><div style={{fontSize:32,lineHeight:1.4,textAlign:'center',padding:'13px 28px',color:'white',background:'#102c30ed',borderRadius:12,maxWidth:1600}}>{cap.text}</div></div>:null}
 <style>{`*{box-sizing:border-box}`}</style>
 <Audio src={staticFile('audio/mix-master.wav')}/>
 </AbsoluteFill>}
export function Root(){return <Composition id="AmexPromo" component={Film} durationInFrames={timing.frames} fps={timing.fps} width={1920} height={1080}/>}
