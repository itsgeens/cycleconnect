import Navbar from "@/components/navbar";
import RideForm from "@/components/ride-form";

export default function CreateRide() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create a New Ride</h1>
          <p className="text-gray-600">Organize a group ride and invite fellow cyclists to join</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <RideForm />
        </div>
      </div>
    </div>
  );
}