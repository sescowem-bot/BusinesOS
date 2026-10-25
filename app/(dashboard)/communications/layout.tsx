import type {ReactNode} from 'react';
import {requireWorkspaceModuleView} from '@/lib/server/visible-modules';

export default async function ModuleAccessLayout({children}:{children:ReactNode}){
 await requireWorkspaceModuleView('communications');
 return children;
}
