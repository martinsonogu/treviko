'use client';
import {useSyncExternalStore} from 'react';
import {formatWorkoutDate} from '@/lib/workouts/dates';
const subscribe=()=>()=>{};
const browserZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone=()=>null;
export default function WorkoutDate({value}:{value:string}){const zone=useSyncExternalStore(subscribe,browserZone,serverZone);return <time dateTime={value} title={zone??undefined}>{zone?formatWorkoutDate(value,zone):'Loading local time…'}</time>;}
