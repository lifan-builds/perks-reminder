// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import React,{useLayoutEffect,useRef,useState} from 'react';
import {continueRender,delayRender,staticFile} from 'remotion';
import styles from './product-ui/styles.json';
import benefits from './product-ui/benefits.json';
import filtered from './product-ui/filtered.json';
import partial from './product-ui/partial.json';
import entry from './product-ui/entry.json';
import claimed from './product-ui/claimed.json';
import cards from './product-ui/cards.json';
import calendar from './product-ui/calendar.json';
import guides from './product-ui/guides.json';
import roi from './product-ui/roi.json';
import sync from './product-ui/sync.json';
import reader from './reader-panel.json';
const states={benefits,filtered,partial,entry,claimed,cards,calendar,guides,roi,sync};
export type ProductState=keyof typeof states;
export function ProductSurface({state}:{state:ProductState}){
 const ref=useRef<HTMLDivElement>(null);const [handle]=useState(()=>delayRender('Product UI assets'));
 useLayoutEffect(()=>{const root=ref.current!.shadowRoot??ref.current!.attachShadow({mode:'open'});root.innerHTML='<style>'+styles.css+(state==='entry'?' .fixed.inset-0{height:514px!important;bottom:auto!important}':'')+'</style>'+states[state].html.replace(/ autoFocus=""| autofocus=""/g,'').replace(/<link[^>]*rel="preload"[^>]*>/g,'');root.querySelectorAll('img').forEach(img=>{if(img.getAttribute('src')?.startsWith('/images/'))img.src=staticFile(img.getAttribute('src')!.slice(1))});Promise.all([document.fonts.ready,...Array.from(root.querySelectorAll('img')).map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve()}))]).then(()=>continueRender(handle));},[state,handle]);
 return <><style>{(styles.css.match(/@property [^{]+\{[^}]+\}/g)??[]).join('\n')}</style><div ref={ref} style={{width:1280,minHeight:1400}}/></>;
}
export function ReaderSurface(){const ref=useRef<HTMLDivElement>(null);useLayoutEffect(()=>{const root=ref.current!.shadowRoot??ref.current!.attachShadow({mode:'open'});root.innerHTML=reader.html;},[]);return <div ref={ref} style={{width:1280,height:800}}/>}
