import 'server-only';
import {cache} from 'react';
import {connection} from 'next/server';
import {requireUser,AuthenticationError} from './session';
import {SupabaseConfigurationError} from '../supabase/config';
// React cache is scoped to the current server render, never shared between accounts.
export const getPageUser=cache(async()=>{await connection();try{return await requireUser();}catch(error){if(error instanceof AuthenticationError||error instanceof SupabaseConfigurationError)return null;throw error;}});
