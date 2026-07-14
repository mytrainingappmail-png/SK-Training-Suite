const courses = [
  {
    title: "Real Estate Foundation",
    level: "Beginner",
    learners: 48,
    duration: "7 Days",
    status: "Active",
  },
  {
    title: "Sales Closing Mastery",
    level: "Intermediate",
    learners: 31,
    duration: "5 Days",
    status: "Active",
  },
  {
    title: "Luxury Project Training",
    level: "Advanced",
    learners: 15,
    duration: "10 Days",
    status: "Draft",
  },
];

function Training() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">

      <div className="flex justify-between items-center mb-8">

        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Training Management
          </h1>

          <p className="text-slate-500 mt-2">
            Create, organize and manage learning programs.
          </p>
        </div>

        <button className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 font-semibold">
          + Create Course
        </button>

      </div>

      <div className="grid grid-cols-3 gap-6">

        {courses.map((course) => (

          <div
            key={course.title}
            className="border rounded-2xl p-6 hover:shadow-lg transition"
          >

            <h2 className="text-xl font-bold">
              {course.title}
            </h2>

            <p className="text-slate-500 mt-2">
              {course.level}
            </p>

            <div className="mt-6 space-y-2 text-sm">

              <div className="flex justify-between">
                <span>Learners</span>
                <strong>{course.learners}</strong>
              </div>

              <div className="flex justify-between">
                <span>Duration</span>
                <strong>{course.duration}</strong>
              </div>

              <div className="flex justify-between">
                <span>Status</span>

                <strong
                  className={
                    course.status === "Active"
                      ? "text-green-600"
                      : "text-orange-500"
                  }
                >
                  {course.status}
                </strong>

              </div>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}

export default Training;