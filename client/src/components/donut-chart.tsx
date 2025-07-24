import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DonutChartProps {
  data: { name: string; value: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']; // Define some colors

const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
  // Filter out data with zero value so they don't appear in the chart
  const chartData = data.filter(item => item.value > 0);

  if (chartData.length === 0) {
    return <div className="text-center text-gray-500">No data to display chart</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60} // Adjust as needed
          outerRadius={80} // Adjust as needed
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
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DonutChart;
