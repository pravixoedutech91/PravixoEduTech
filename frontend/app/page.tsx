import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="bg-blue-700 text-white py-20">
          <div className="max-w-6xl mx-auto px-4">
            <h1 className="text-5xl font-bold mb-4">
              PravixoEduTech
            </h1>

            <p className="text-xl mb-8">
              Your Gateway to Government Exam Success
            </p>

            <button className="bg-white text-blue-700 px-6 py-3 rounded-lg font-semibold">
              Explore Notes
            </button>
          </div>
        </section>

        {/* Latest Notifications */}
        <section className="py-16 bg-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8">
              Latest Notifications
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-lg shadow">
                MPPSC Notification 2026 Released
              </div>

              <div className="bg-white p-5 rounded-lg shadow">
                SSC CGL Registration Started
              </div>

              <div className="bg-white p-5 rounded-lg shadow">
                Railway Recruitment Update
              </div>
            </div>
          </div>
        </section>

        {/* Popular Notes */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8">
              Popular Study Notes
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="border p-5 rounded-lg">
                Indian Polity Notes
              </div>

              <div className="border p-5 rounded-lg">
                Modern History Notes
              </div>

              <div className="border p-5 rounded-lg">
                Geography Notes
              </div>
            </div>
          </div>
        </section>

        {/* Current Affairs */}
        <section className="py-16 bg-gray-100">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-8">
              Current Affairs
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-lg shadow">
                Weekly Current Affairs Highlights
              </div>

              <div className="bg-white p-5 rounded-lg shadow">
                Monthly Current Affairs Magazine
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}