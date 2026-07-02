const activities = [
  "Aman completed Sales Induction Program",
  "Rohit started Advanced Negotiation Course",
  "Simran passed Product Knowledge Assessment",
  "Neha received Sales Excellence Certificate",
];

function RecentActivity() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

      <h2 className="text-xl font-bold text-slate-800 mb-6">
        Recent Activities
      </h2>

      <div className="space-y-4">

        {activities.map((item) => (

          <div
            key={item}
            className="border-l-4 border-yellow-500 pl-4 py-2"
          >
            <p className="text-slate-700">
              {item}
            </p>
          </div>

        ))}

      </div>

    </div>
  );
}

export default RecentActivity;