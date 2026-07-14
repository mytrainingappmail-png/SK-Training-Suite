import { useParams } from "react-router-dom";
import ResourceViewer from "../components/learning/ResourceViewer";

function ResourceViewerPage() {
  const { resourceId, lessonId } = useParams<{ resourceId: string; lessonId: string }>();
  return <ResourceViewer resourceId={resourceId ?? ""} lessonId={lessonId ?? ""} />;
}

export default ResourceViewerPage;
