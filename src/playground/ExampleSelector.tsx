import { ExampleKey, examples } from './examples'

interface ExampleSelectorProps {
    activeExample: ExampleKey
    onExampleChange: (key: ExampleKey) => void
}

export const ExampleSelector = ({ activeExample, onExampleChange }: ExampleSelectorProps) => {
    return (
        <div className="example-selector">
            {(Object.keys(examples) as Array<ExampleKey>).map((key) => (
                <button
                    key={key}
                    onClick={() => onExampleChange(key)}
                    className={`example-button ${activeExample === key ? 'active' : ''}`}
                >
                    {key}
                </button>
            ))}
        </div>
    )
}
