// Static component tests supply the same router context as the App Router shell.
import React from 'react';
import context from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
const router={refresh(){},push(){},replace(){},back(){},forward(){},prefetch(){}};
export const withAppRouter=element=>React.createElement(context.AppRouterContext.Provider,{value:router},element);
