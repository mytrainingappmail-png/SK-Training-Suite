import { useParams } from "react-router-dom";
import LessonPlayer from "../components/learning/LessonPlayer";

function LessonPlayerPage() {
  const { lessonId, moduleId } = useParams<{ lessonId: string; moduleId: string }>();
  return <LessonPlayer lessonId={lessonId ?? ""} moduleId={moduleId ?? ""} />;
}

export default LessonPlayerPage;
