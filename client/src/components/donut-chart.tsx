import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DonutChartProps {
  data: { name: string; value: number }[];
  totalCompletedRides: number; // Add totalCompletedRides prop
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']; // Define some colors

const DonutChart: React.FC<DonutChartProps> = ({ data, totalCompletedRides }) => {
  // REMOVED: Filter out data with zero value so they don't appear in the chart
  // const chartData = data.filter(item => item.value > 0);

  return (
    <ResponsiveContainer width="100%" height={200}> {/* Reduced height */}
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60} // Reduced radius
          outerRadius={100} // Reduced radius
          fill="#8884d8"
          paddingAngle={2} // Adjust as needed
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-4xl font-bold text-gray-900" // Apply Tailwind classes for styling
        >
          {totalCompletedRides}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
