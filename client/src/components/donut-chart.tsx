import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DonutChartProps {
  data: { name: string; value: number }[];
  totalCompletedRides: number; // Add totalCompletedRides prop
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']; // Define some colors

const DonutChart: React.FC<DonutChartProps> = ({ data, totalCompletedRides }) => {
  // Filter out data with zero value so they don't appear in the chart
  const chartData = data.filter(item => item.value > 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={80} // Adjust as needed
          outerRadius={100} // Adjust as needed
          fill="#8884d8"
          paddingAngle={2} // Adjust as needed
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-2xl font-bold text-gray-800" // Apply Tailwind classes for styling
        >
          {totalCompletedRides}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
