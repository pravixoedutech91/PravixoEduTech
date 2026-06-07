export default function Navbar() {
  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-blue-700">
          PravixoEduTech
        </h2>

        <div className="flex gap-6">
          <a href="#">Home</a>
          <a href="#">Notes</a>
          <a href="#">Current Affairs</a>
          <a href="#">Mock Tests</a>
          <a href="#">Jobs</a>
        </div>
      </div>
    </nav>
  );
}