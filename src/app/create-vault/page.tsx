"use client"
import Navigation from '@/components/Navigation'
import React from 'react'

const InitializeVault = () => {

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        // derive pdas
        // call the initialize vault instruction
        // user signs transaction

    }
    return (
        <div className='min-h-screen'>
            <Navigation />
            <form onSubmit={handleSubmit}></form>
        </div>
    )
}

export default InitializeVault