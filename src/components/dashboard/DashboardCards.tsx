import StatsCard from "./StatsCard";

const cards = [
  {
    title: "Active Learners",
    value: "248",
    color: "bg-blue-500",
  },
  {
    title: "Training Programs",
    value: "32",
    color: "bg-green-500",
  },
  {
    title: "Assessments",
    value: "18",
    color: "bg-orange-500",
  },
  {
    title: "Certificates",
    value: "126",
    color: "bg-purple-500",
  },
];

function DashboardCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

  {cards.map((card) => (

    <StatsCard
      key={card.title}
      title={card.title}
      value={card.value}
      color={card.color}
    />

  ))}

</div>
  );
}

export default DashboardCards;