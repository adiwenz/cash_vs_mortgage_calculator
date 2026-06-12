
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export default function ComparisonTable({ data, visibleScenarios, scenarioInfo }) {
  // Get active scenarios
  const activeScenarios = Object.entries(scenarioInfo).filter(([key]) => visibleScenarios[key]);

  const handleExportCSV = () => {
    // Construct CSV Header
    let headers = ['Year', 'Home Value', 'Mortgage Balance'];
    activeScenarios.forEach(([, info]) => {
      headers.push(info.label);
    });

    let csvContent = headers.join(',') + '\n';

    // Construct CSV rows
    data.forEach((row) => {
      let line = [row.year, Math.round(row.homeValue), Math.round(row.mortgageBalance)];
      activeScenarios.forEach(([, info]) => {
        line.push(Math.round(row[info.dataKey]));
      });
      csvContent += line.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'mortgage_vs_cash_comparison.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-header">
        <h2 className="card-title">Year-by-Year Calculations</h2>
        <button
          onClick={handleExportCSV}
          className="btn-icon"
          title="Export CSV"
          style={{ width: 'auto', padding: '0 1rem', display: 'flex', gap: '0.5rem', fontWeight: '500', fontSize: '0.85rem' }}
        >
          <span>📥</span> Export CSV
        </button>
      </div>

      <div className="table-container">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Home Value</th>
              <th>Mortgage Balance</th>
              {activeScenarios.map(([key, info]) => (
                <th key={key} style={{ borderBottom: `2px solid ${info.color}` }}>
                  {info.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.year}>
                <td style={{ fontWeight: '600' }}>{row.year}</td>
                <td>{formatCurrency(row.homeValue)}</td>
                <td>{row.year === 0 && row.mortgageBalance === 0 ? '-' : formatCurrency(row.mortgageBalance)}</td>
                {activeScenarios.map(([key, info]) => {
                  const val = row[info.dataKey];
                  return (
                    <td key={key} className="table-highlight-col">
                      {formatCurrency(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
