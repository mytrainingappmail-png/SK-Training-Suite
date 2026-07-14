import { useParams } from "react-router-dom";
import CoursePlayer from "../components/learning/CoursePlayer";

function CoursePlayerPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  return <CoursePlayer enrollmentId={enrollmentId ?? ""} />;
}

export default CoursePlayerPage;
