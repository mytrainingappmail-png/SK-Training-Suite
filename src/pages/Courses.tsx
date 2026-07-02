import Header from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/Sidebar";

const courses = [
  {
    id: "CRS-001",
    title: "Real Estate Foundation",
    category: "Sales",
    trainer: "Inder Bhatnagar",
    learners: 48,
    status: "Published",
  },
  {
    id: "CRS-002",
    title: "Luxury Sales",
    category: "Advanced Sales",
    trainer: "Rahul Sharma",
    learners: 26,
    status: "Draft",
  },
];

function Courses() {
  return (
    <div className="flex min-h-screen bg-slate-100">

      <Sidebar />

      <div className="flex-1 flex flex-col">

        <Header />

        <main className="p-8">

          <div className="bg-white rounded-2xl shadow-sm p-8">

            <div className="flex justify-between items-center mb-8">

              <div>
                <h1 className="text-3xl font-bold">
                  Course Management
                </h1>

                <p className="text-slate-500 mt-2">
                  Create, manage and publish learning courses.
                </p>
              </div>

              <button className="bg-yellow-500 px-5 py-3 rounded-xl font-semibold">
                + New Course
              </button>

            </div>

            <table className="w-full">

              <thead>

                <tr className="border-b">

                  <th className="text-left py-3">Course ID</th>
                  <th className="text-left">Course</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Trainer</th>
                  <th className="text-left">Learners</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Action</th>

                </tr>

              </thead>

              <tbody>

                {courses.map((course) => (

                  <tr key={course.id} className="border-b">

                    <td className="py-4">{course.id}</td>

                    <td>{course.title}</td>

                    <td>{course.category}</td>

                    <td>{course.trainer}</td>

                    <td>{course.learners}</td>

                    <td>{course.status}</td>

                    <td className="space-x-2">

                      <button className="text-blue-600">
                        Edit
                      </button>

                      <button className="text-red-600">
                        Delete
                      </button>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </main>

      </div>

    </div>
  );
}

export default Courses;