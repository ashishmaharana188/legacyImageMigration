
import React from 'react';

interface SanityCheckUIProps {
  handleSanityCheck: () => Promise<void>;
}

const SanityCheckUI: React.FC<SanityCheckUIProps> = ({
  handleSanityCheck,
}) => {
  return (
    <div>
      <h3>Sanity Check</h3>
      <button onClick={handleSanityCheck}>
        Run Sanity Check
      </button>
    </div>
  );
};

export default SanityCheckUI;
