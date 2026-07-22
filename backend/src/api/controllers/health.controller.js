export const getHealthStatus = (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
    });
};
