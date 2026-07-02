import Header from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/Sidebar";

function Employees() {
  return (
    <div className="flex min-h-screen bg-slate-100">

      <Sidebar />

      <div className="flex-1 flex flex-col">

        <Header />

        <main className="p-8">

          <div className="bg-white rounded-2xl shadow-sm p-8">

            <div className="flex items-center justify-between mb-6">

              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Employees
                </h1>

                <p className="text-slate-500 mt-1">
                  Manage learners, trainers and administrators.
                </p>
              </div>

              <button className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-semibold">
                + Add Employee
              </button>

            </div>

            <table className="w-full border-collapse">

              <thead>

                <tr className="border-b">

                  <th className="text-left py-3">Employee ID</th>
                  <th className="text-left py-3">Name</th>
                  <th className="text-left py-3">Department</th>
                  <th className="text-left py-3">Role</th>
                  <th className="text-left py-3">Status</th>

                </tr>

              </thead>

              <tbody>

                <tr className="border-b">
                  <td className="py-4">EMP001</td>
                  <td>Rahul Sharma</td>
                  <td>Sales</td>
                  <td>Learner</td>
                  <td className="text-green-600 font-medium">Active</td>
                </tr>

                <tr className="border-b">
                  <td className="py-4">EMP002</td>
                  <td>Priya Singh</td>
                  <td>Training</td>
                  <td>Trainer</td>
                  <td className="text-green-600 font-medium">Active</td>
                </tr>

                <tr>
                  <td className="py-4">EMP003</td>
                  <td>Amit Kumar</td>
                  <td>HR</td>
                  <td>Admin</td>
                  <td className="text-yellow-600 font-medium">Pending</td>
                </tr>

              </tbody>

            </table>

          </div>

        </main>

      </div>

    </div>
  );
}

export default Employees;