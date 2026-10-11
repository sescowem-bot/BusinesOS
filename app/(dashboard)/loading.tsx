import {WorkspaceLoadingBrand} from '@/components/workspace-loading-brand';
/** A branded shell fallback rather than a misleading fake loading progress bar. */
export default function BusinessWorkspaceLoading(){return <WorkspaceLoadingBrand mode="workspace" label="Preparing workspace"/>;}
