'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

const GraphComponent = ({ data }) => (
  <LineChart width={500} height={300} data={data}>
    <XAxis dataKey="x" />
    <YAxis dataKey="y" />
    <Tooltip />
    <Line type="monotone" dataKey="y" stroke="#8884d8" />
  </LineChart>
);

export default GraphComponent;