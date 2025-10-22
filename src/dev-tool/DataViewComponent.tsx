import React, { useMemo } from "react";


export type DataViewComponent = React.FC<{ value: any; name: string; }>;

export const DataViewDefault: DataViewComponent = ({ name, value }) => {

    const renderString = useMemo(() => {
        try {
            return JSON.stringify({ [name]: value }, null, 2);
        } catch (error) {
            return String(error);
        }
    }, [name, value]);

    return <pre>{renderString}</pre>;
};
