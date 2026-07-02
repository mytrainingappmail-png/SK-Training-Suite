const actions = [
  {
    title: "Create Course",
    color: "bg-blue-600",
  },
  {
    title: "Add Learner",
    color: "bg-green-600",
  },
  {
    title: "Create Assessment",
    color: "bg-orange-500",
  },
  {
    title: "Issue Certificate",
    color: "bg-purple-600",
  },
];

function QuickActions() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

      <h2 className="text-xl font-bold text-slate-800 mb-6">
        Quick Actions
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {actions.map((item) => (

          <button
            key={item.title}
            className={`${item.color} text-white rounded-xl py-5 font-semibold hover:scale-105 transition`}
          >
            {item.title}
          </button>

        ))}

      </div>

    </div>
  );
}

export default QuickActions;