import React from 'react';

interface OngLogoProps {
  className?: string;
}

export const OngLogo: React.FC<OngLogoProps> = ({ className = 'h-7 w-auto text-black' }) => {
  return (
    <div className="flex items-center select-none">
      <svg
        viewBox="0 0 110 32"
        className={className}
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Letter O */}
        <path
          d="M 6 0 L 26 0 C 30 0 32 2 32 6 L 32 26 C 32 30 30 32 26 32 L 6 32 C 2 32 0 30 0 26 L 0 6 C 0 2 2 0 6 0 Z M 10 9 C 9 9 9 9.5 9 10 L 9 22 C 9 22.5 9 23 10 23 L 22 23 C 23 23 23 22.5 23 22 L 23 10 C 23 9.5 23 9 22 9 Z"
          fillRule="evenodd"
        />

        {/* Letter N */}
        <path
          d="M 39 0 L 48 0 L 61 17.5 L 61 0 L 70 0 L 70 32 L 61 32 L 48 14.5 L 48 32 L 39 32 Z"
        />

        {/* Letter G */}
        <path
          d="M 83 0 L 103 0 C 107 0 109 2 109 6 L 109 11 L 100 11 L 100 9 C 100 8.5 99.5 8.5 99 8.5 L 87 8.5 C 86.5 8.5 86.5 8.5 86.5 9 L 86.5 23 C 86.5 23.5 86.5 23.5 87 23.5 L 99 23.5 C 99.5 23.5 100 23.5 100 23 L 100 17 L 93 17 L 93 11 L 109 11 L 109 26 C 109 30 107 32 103 32 L 83 32 C 79 32 77 30 77 26 L 77 6 C 77 2 79 0 83 0 Z"
          fillRule="evenodd"
        />
      </svg>
    </div>
  );
};
