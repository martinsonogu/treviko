import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import {loadSource as load} from './load-source.mjs';
const {AppNavigation,primaryDestinations,isDestinationActive}=load('src/components/Nav.tsx');
test('desktop and mobile navigation share five ordered, labelled destinations with decorative icons',()=>{
 for(const variant of ['desktop','mobile']){
  const html=renderToStaticMarkup(React.createElement(AppNavigation,{pathname:'/coach',variant}));
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]),['/','/coach','/training','/nutrition','/progress']);
  assert.deepEqual([...html.matchAll(/<span>([^<]+)<\/span>/g)].map(match=>match[1]),['Home','Coach','Training','Nutrition','Progress']);
  assert.equal((html.match(/aria-current="page"/g)??[]).length,1);
  assert.equal((html.match(/aria-hidden="true" focusable="false"/g)??[]).length,5);
  assert.doesNotMatch(html,/role="tab"|tabindex="-1"/i);
 }
});
test('nested exercise, session and review URLs retain their parent destination without prefix collisions',()=>{
 for(const [path,expected] of [['/','/'],['/training/exercises/dumbbell-shrug','/training'],['/training/sessions/example','/training'],['/coach/plans/review','/coach'],['/nutrition/plans/example','/nutrition'],['/progress/week','/progress'],['/settings',null],['/training-other',null]]){
  assert.deepEqual(primaryDestinations.filter(d=>isDestinationActive(path,d.href)).map(d=>d.href),expected?[expected]:[]);
 }
});
test('manifest, viewport and installation icons match Treviko without disabling zoom or claiming offline support',async()=>{
 const manifest=load('src/app/manifest.ts').default();
 const root=await readFile('src/app/layout.tsx','utf8');
 assert.match(root,/viewportFit:'cover'/);assert.match(root,/themeColor:'#143e30'/);assert.match(root,/appleWebApp:\{capable:true/);assert.doesNotMatch(root,/maximumScale|userScalable/);assert.match(root,/apple:\[\{url:'\/apple-icon.png'/);
 assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.id,'/');
 assert.equal(manifest.theme_color,'#143e30');
 for(const icon of manifest.icons){const image=await readFile('public'+icon.src);assert.equal(image.subarray(1,4).toString(),'PNG');assert.equal(`${image.readUInt32BE(16)}x${image.readUInt32BE(20)}`,icon.sizes);}
 const apple=await readFile('src/app/apple-icon.png');assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
 assert.equal(manifest.icons.find(icon=>icon.purpose==='maskable')?.sizes,'512x512');
});
