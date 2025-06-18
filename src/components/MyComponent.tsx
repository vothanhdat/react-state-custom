import React from 'react';

interface MyComponentProps {
    title: string;
    description?: string;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, description }) => {
    return (
        <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
        </div>
    );
};

export default MyComponent;