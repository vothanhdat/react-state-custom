import { useState, useEffect } from 'react'
import './playground.css'
import { examples, ExampleKey } from './examples'
import { PlaygroundHeader } from './PlaygroundHeader'
import { ExampleSelector } from './ExampleSelector'
import { StackBlitzEditor } from './StackBlitzEditor'
import { DocumentationSection } from './DocumentationSection'

export const Playground = () => {
    const [activeExample, setActiveExample] = useState<ExampleKey>('counter')
    const example = examples[activeExample]

    // Highlight code blocks on mount and when content changes
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).Prism) {
            (window as any).Prism.highlightAll()
        }
    }, [activeExample])

    return (
        <div className="playground-container">
            <PlaygroundHeader />

            <div className="content-card">
                <ExampleSelector 
                    activeExample={activeExample} 
                    onExampleChange={setActiveExample}
                />

                <div className="example-info">
                    <h2 className="example-title">{example.title}</h2>
                    <p className="example-description">
                        {example.description}
                    </p>
                </div>

                <StackBlitzEditor example={example} />
            </div>

            <DocumentationSection />
        </div>
    )
}
