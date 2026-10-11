import {WorkspaceLoadingBrand} from '@/components/workspace-loading-brand';
/** Lightweight application-wide fallback, no database access or external resources. */
export default function GlobalLoading(){return <WorkspaceLoadingBrand label="Loading BusinessOS" mode="workspace"/>;}
