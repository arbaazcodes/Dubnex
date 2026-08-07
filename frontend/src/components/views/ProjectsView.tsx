// ProjectsView - Project list / details feature module.
import ProjectDetails from '../dashboard/ProjectDetails';
import ProjectsDashboard from '../dashboard/ProjectsDashboard';
import type { Project, TranscriptSegment } from '../../types';

type MainView = 'studio' | 'projects' | 'project-details' | 'voices';
type AppState = 'upload' | 'processing' | 'result';

interface ProjectsViewProps {
  variant: 'details' | 'list';
  activeProject: Project | null;
  projects: Project[];
  selectedProjectId: string | null;
  handlePreviewProject: (id: string) => void;
  handleOpenProjectDetails: (id: string) => void;
  handleDownloadProject: (project: Project) => void;
  handleDeleteProject: (id: string) => void;
  handleDuplicateProject: (id: string) => void;
  handleSaveTranscript: (updatedTranscript: TranscriptSegment[]) => void;
  setMainView: (view: MainView) => void;
  setAppState: (state: AppState) => void;
}

export default function ProjectsView({
  variant,
  activeProject,
  projects,
  selectedProjectId,
  handlePreviewProject,
  handleOpenProjectDetails,
  handleDownloadProject,
  handleDeleteProject,
  handleDuplicateProject,
  handleSaveTranscript,
  setMainView,
  setAppState,
}: ProjectsViewProps) {
  return (
    variant === 'details' ? (
          <section className="lg:col-span-12">
            <ProjectDetails
              project={activeProject!}
              onBack={() => setMainView('projects')}
              onPreview={handlePreviewProject}
              onDownload={handleDownloadProject}
              onSaveTranscript={handleSaveTranscript}
            />
          </section>
    ) : (
          <section className="lg:col-span-12">
            <ProjectsDashboard
              projects={projects}
              activeProjectId={selectedProjectId}
              onPreview={handlePreviewProject}
              onDownload={handleDownloadProject}
              onDelete={handleDeleteProject}
              onDuplicate={handleDuplicateProject}
              onOpenDetails={handleOpenProjectDetails}
              onBackToStudio={() => {
                setMainView('studio');
                setAppState('upload');
              }}
            />
          </section>
    )
  );
}
