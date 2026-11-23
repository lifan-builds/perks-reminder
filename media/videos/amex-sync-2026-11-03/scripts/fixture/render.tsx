// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 lifan-builds and contributors. Perks Reminder; Section 7 attribution terms in ATTRIBUTION.md.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Benefits from '@/components/BenefitsDisplayClient';
import Benefit from '@/components/BenefitCardClient';
import Guides from '@/app/benefits/how-to-use/page';
import PageHeader from '@/components/ui/PageHeader';
import {getPublicStaticCards} from '@/lib/static-catalog';
import {PredefinedCardForm} from './CardForm';
import Calendar from './Calendar';
import {AmexSyncHandoffClient} from '@/app/integrations/amex-sync/AmexSyncHandoffClient';
const variant=process.env.VIDEO_VARIANT;
const selected=getPublicStaticCards().filter(c=>['American Express Gold Card','American Express Platinum Card','Chase Sapphire Preferred'].includes(c.name)).slice(0,3);
const gold={id:'demo-gold',name:'American Express Gold Card',displayName:'American Express Gold Card · 56789',issuer:'American Express',lastFourDigits:'56789',nickname:null};
const plat={id:'demo-plat',name:'American Express Platinum Card',displayName:'American Express Platinum Card · 12345',issuer:'American Express',lastFourDigits:'12345',nickname:null};
const d=(v:string)=>new Date(v+'T12:00:00Z');
const status=(id:string,description:string,maxAmount:number,usedAmount:number,card:any,category:string,frequency:string,done=false):any=>({id,cycleStartDate:d(frequency==='SEMI_ANNUALLY'?'2026-07-01':'2026-11-01'),cycleEndDate:d(frequency==='SEMI_ANNUALLY'?'2026-12-31':'2026-11-30'),isCompleted:done,completedAt:done?d('2026-11-02'):null,usedAmount,isNotUsable:false,notes:null,trackingMode:'TRACK',usageWaySlug:'amex-gold-dining-credit',source:'global',isCustomBenefit:false,canMutateDefinition:false,benefit:{id:'b-'+id,description,maxAmount,category,frequency,creditCard:card}});
const partial=variant==='partial'?7:0;
const upcoming=[status('dining','Dining Credit',10,partial,gold,'Dining','MONTHLY'),status('resy','Resy Credit',50,10,gold,'Dining','SEMI_ANNUALLY'),status('entertainment','Digital Entertainment Credit',25,0,plat,'Entertainment','MONTHLY'),status('uber','Uber Cash',15,0,plat,'Transportation','MONTHLY')];
const done=[status('hotel','Hotel Credit',300,300,plat,'Travel','SEMI_ANNUALLY',true)];
if(variant==='claimed'||variant==='roi'){done.push({...upcoming[0],usedAmount:10,isCompleted:true});upcoming.shift();}
const roi=[{cardId:gold.id,cardName:gold.name,cardDisplayName:gold.displayName,annualFee:325,claimedValue:0,netRoi:0},{cardId:plat.id,cardName:plat.name,cardDisplayName:plat.displayName,annualFee:895,claimedValue:0,netRoi:0}];
const events=[{id:'a',date:d('2026-11-15'),kind:'signup_bonus_deadline',title:'Welcome bonus spending deadline',cardName:'Chase Sapphire Preferred',cardIssuer:'Chase',cardId:'demo-chase'},{id:'b',date:d('2026-11-30'),kind:'benefit_expires',title:'Dining Credit',cardName:gold.name,cardIssuer:gold.issuer,cardId:gold.id,amount:10},{id:'c',date:d('2026-11-30'),kind:'benefit_expires',title:'Digital Entertainment Credit',cardName:plat.name,cardIssuer:plat.issuer,cardId:plat.id,amount:25},{id:'d',date:d('2026-12-12'),kind:'annual_fee',title:'Annual fee renewal',cardName:gold.name,cardIssuer:gold.issuer,cardId:gold.id,amount:325}];
export async function render(){let body;
 if(variant==='cards')body=<div className="mx-auto max-w-7xl px-8 py-6"><PageHeader title="Add Credit Card" description="Choose from supported cards and start tracking your benefits."/><div className="grid grid-cols-3 gap-6">{selected.map(card=><PredefinedCardForm key={card.id} card={card}/>)}</div></div>;
 else if(variant==='calendar')body=<Calendar events={events} cards={[gold,plat,{}]}/>;
 else if(variant==='sync')body=<div style={{padding:24}}><AmexSyncHandoffClient transferId={'a'.repeat(32)} initialMode="preview"/></div>;
 else if(variant==='guides')body=await Guides();
 else body=<Benefits upcomingBenefits={upcoming} completedBenefits={done} scheduledBenefits={[]} totalUnusedValue={upcoming.reduce((s,b)=>s+b.benefit.maxAmount-b.usedAmount,0)} totalUsedValue={done.reduce((s,b)=>s+b.usedAmount,0)+upcoming.reduce((s,b)=>s+b.usedAmount,0)} totalAnnualFees={1220} cardLevelRoi={roi} cardCount={2} notifyBenefitExpiration/>;
 return renderToStaticMarkup(<div>{body}</div>);
}
