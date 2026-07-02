interface StatsCardProps {
  title: string;
  value: string | number;
  color: string;
}

function StatsCard({
  title,
  value,
  color,
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-lg transition-all duration-300">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-sm text-slate-500">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-800">
            {value}
          </h2>
        </div>

        <div
          className={`w-14 h-14 rounded-xl ${color}`}
        />

      </div>

      <div className="mt-6 h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: "70%" }}
        />
      </div>

    </div>
  );
}

export default StatsCard;